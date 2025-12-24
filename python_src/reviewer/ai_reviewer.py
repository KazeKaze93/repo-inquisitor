import os
import logging
import sys
import time
import re
from typing import Tuple, Optional

# --- NEW SDK IMPORTS ---
from google import genai
from google.genai import types
from github import Github, GithubException, Auth

# --- CONFIGURATION ---
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)]
)
logger = logging.getLogger(__name__)

# Extensions to watch
REVIEWABLE_EXTENSIONS = ('.ts', '.tsx', '.js', '.css', '.sql', '.py', '.md', '.json', '.yml', '.toml')

# Models priority
MODEL_PRIORITIES = [

    "gemini-3-flash-preview",

    "gemini-2.5-flash",

    "gemini-2.5-flash-lite",

    "gemini-2.5-pro",

    "gemini-2.0-flash",

    "gemini-2.0-flash-lite",

    "gemini-2.0-pro",

]

DEFAULT_MODEL_NAME = "gemini-2.0-flash"

class ReviewerError(Exception):
    "Base class for reviewer script errors."
    pass

# Environment Variables
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
GITHUB_TOKEN = os.getenv("GITHUB_TOKEN")
REPO_NAME = os.getenv("REPO_NAME")
PR_NUMBER_STR = os.getenv("PR_NUMBER")
MODEL_NAME = os.getenv("MODEL_NAME", DEFAULT_MODEL_NAME)

def load_prompt() -> str:
    "Loads the system prompt from system_prompt.md file."
    try:
        script_dir = os.path.dirname(os.path.abspath(__file__))
        prompt_path = os.path.join(script_dir, 'system_prompt.md')
        
        with open(prompt_path, 'r', encoding='utf-8') as f:
            return f.read()
    except FileNotFoundError:
        # Fallback for when running from root
        if os.path.exists('system_prompt.md'):
            with open('system_prompt.md', 'r', encoding='utf-8') as f:
                return f.read()
        raise ReviewerError(f"system_prompt.md not found in {script_dir} or current dir!")

def get_pr_data() -> Tuple[object, str, str, str]:
    """
    Fetches PR diff AND context (Title/Description) from GitHub.
    Returns: (pr_object, diff_text, pr_title, pr_body)
    """
    if not GITHUB_TOKEN or not REPO_NAME or not PR_NUMBER_STR:
        raise ValueError("Missing GitHub credentials or PR info.")
    
    try:
        auth = Auth.Token(GITHUB_TOKEN)
        g = Github(auth=auth)
        
        repo = g.get_repo(REPO_NAME)
        pr = repo.get_pull(int(PR_NUMBER_STR))
        
        files = pr.get_files()
        diff_content = []
        
        logger.info(f"Processing PR #{PR_NUMBER_STR}: {pr.title}")

        for f in files:
            if f.status == "removed":
                continue
            
            # Ignore lockfiles and build artifacts and repomix output
            if any(x in f.filename for x in ["package-lock.json", "yarn.lock", "pnpm-lock.yaml", "dist/", "out/", "build/", "repomix-output.xml"]):
                continue

            if f.filename.endswith(REVIEWABLE_EXTENSIONS):
                # Guard against None patch (binary files, large diffs, or pure renames)
                if not f.patch:
                    logger.warning(f"Skipping {f.filename}: No patch data available (binary or too large).")
                    continue

                # Limit patch size per file to avoid context overflow on huge files
                patch = f.patch if len(f.patch) < 20000 else f.patch[:20000] + "\n... [TRUNCATED]"
                diff_content.append(f"### File: {f.filename}\n```diff\n{patch}\n```")
        
        full_diff = "\n\n".join(diff_content)
        return pr, full_diff, pr.title, (pr.body or "No description provided.")
        
    except GithubException as e:
        logger.error(f"GitHub API Error: {e}")
        raise
    except ValueError as e:
        logger.error(f"Invalid PR number: {e}")
        raise

def analyze_code(diff_text: str, pr_title: str, pr_desc: str, system_prompt: str, model_name: str) -> Optional[str]:
    if not GEMINI_API_KEY:
        raise ReviewerError("GEMINI_API_KEY is missing.")

    # --- NEW SDK CLIENT ---
    client = genai.Client(api_key=GEMINI_API_KEY)
    
    # --- ENRICHED PROMPT WITH CONTEXT ---
    user_message = f"""
    {system_prompt}

    # CONTEXT
    **PR Title:** {pr_title}
    **PR Description:** {pr_desc}

    # INSTRUCTIONS
    Review the code changes below. 
    - Verify if the code changes match the PR intent described above.
    - If the user explicitly states they are removing a feature (like a Worker) for simplification, DO NOT flag it as a "Performance issue" unless it breaks the app completely.
    - Focus on Security, Bugs, and sloppy Types.

    <code_diff>
    {diff_text}
    </code_diff>
    """
    
    try:
        # --- NEW SDK GENERATION CALL ---
        response = client.models.generate_content(
            model=model_name,
            contents=user_message,
            config=types.GenerateContentConfig(
                max_output_tokens=8192,
                temperature=0.2,
            )
        )
        return response.text
    except Exception as e:
        raise ReviewerError(f"Unexpected error during analysis: {e}")

def parse_retry_delay(error_message: str) -> Optional[float]:
    patterns = [
        r'retry in (\d+(?:\.\d+)?) seconds?',
        r'retry after (\d+(?:\.\d+)?) seconds?',
        r'wait (\d+(?:\.\d+)?) seconds?',
        r'429',
        r'resource exhausted'
    ]
    for pattern in patterns:
        match = re.search(pattern, error_message.lower())
        if match:
            try:
                # If we matched a number group
                if match.groups():
                    return float(match.group(1))
                return 5.0 # Default wait if just 429 detected
            except (ValueError, IndexError):
                return 5.0
    return None

def main() -> None:
    try:
        system_prompt = load_prompt()
        pr, diff_text, pr_title, pr_desc = get_pr_data()
        
        if not diff_text:
            logger.warning("No reviewable code changes found (or only ignored files).")
            return

        models_to_try = MODEL_PRIORITIES.copy()
        if MODEL_NAME and MODEL_NAME not in MODEL_PRIORITIES:
            models_to_try.insert(0, MODEL_NAME)

        review_comment = None
        successful_model = None
        last_error = None
        
        for model_name in models_to_try:
            try:
                logger.info(f"Analyzing with {model_name}...")
                
                review_comment = analyze_code(diff_text, pr_title, pr_desc, system_prompt, model_name)
                successful_model = model_name
                logger.info(f"Successfully analyzed with {model_name}")
                break
                
            except Exception as e:
                error_message = str(e)
                last_error = e
                
                # Simple retry logic for 429/Quota using generic Exception as new SDK wrappers vary
                if "429" in error_message or "resource exhausted" in error_message.lower():
                    logger.warning(f"Rate limit hit ({model_name}). Waiting...")
                    time.sleep(10) # Simple wait
                    continue
                
                logger.warning(f"API Error ({model_name}): {e}. Switching to next model...")
                continue
        
        if review_comment and successful_model:
            logger.info("Posting comment to GitHub...")
            final_comment = f"## 🛡️ Архитектор (AI Review)\n\n{review_comment}\n\n*Analyzed by: {successful_model}*"
            pr.create_issue_comment(final_comment)
            logger.info("Done.")
        else:
            logger.error(f"All models failed. Last error: {last_error}")
            sys.exit(1)
            
    except Exception as e:
        logger.critical(f"Fatal Reviewer Error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()