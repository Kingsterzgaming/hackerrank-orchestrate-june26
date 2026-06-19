import os
import json
from pathlib import Path

import pandas as pd
from PIL import Image
import google.generativeai as genai

# ============================================================
# CONFIG
# ============================================================

ROOT = Path(__file__).resolve().parent.parent

DATASET_DIR = ROOT / "dataset"

CLAIMS_FILE = DATASET_DIR / "claims.csv"
HISTORY_FILE = DATASET_DIR / "user_history.csv"
REQUIREMENTS_FILE = DATASET_DIR / "evidence_requirements.csv"

OUTPUT_FILE = ROOT / "output.csv"

OUTPUT_COLUMNS = [
    "user_id",
    "image_paths",
    "user_claim",
    "claim_object",
    "evidence_standard_met",
    "evidence_standard_met_reason",
    "risk_flags",
    "issue_type",
    "object_part",
    "claim_status",
    "claim_status_justification",
    "supporting_image_ids",
    "valid_image",
    "severity"
]

# ============================================================
# GEMINI SETUP
# ============================================================

API_KEY = os.getenv("GEMINI_API_KEY")

if not API_KEY:
    raise ValueError(
        "GEMINI_API_KEY environment variable not found"
    )

genai.configure(api_key=API_KEY)

model = genai.GenerativeModel(
    "gemini-2.5-flash"
)

# ============================================================
# DATA LOADERS
# ============================================================

def load_claims():
    return pd.read_csv(CLAIMS_FILE)


def load_history():
    return pd.read_csv(HISTORY_FILE).set_index("user_id")


def load_requirements():
    return pd.read_csv(REQUIREMENTS_FILE)


# ============================================================
# HELPERS
# ============================================================

def get_user_history(user_id, history_df):

    if user_id not in history_df.index:
        return {}

    return history_df.loc[user_id].to_dict()


def get_requirements(claim_object, requirements_df):

    rows = requirements_df[
        requirements_df["claim_object"].isin(
            [claim_object, "all"]
        )
    ]

    return rows.to_dict("records")


def get_image_ids(image_paths):

    return [
        Path(path.strip()).stem
        for path in image_paths.split(";")
        if path.strip()
    ]


def parse_image_paths(image_paths):

    paths = []

    for path in image_paths.split(";"):

        path = path.strip()

        if not path:
            continue

        paths.append(ROOT / path)

    return paths


# ============================================================
# PROMPT
# ============================================================

def build_prompt(
    user_claim,
    claim_object,
    history,
    requirements
):

    return f"""
You are an expert insurance damage reviewer.

Analyze the provided images.

User Claim:
{user_claim}

Claim Object:
{claim_object}

User History:
{json.dumps(history, indent=2)}

Evidence Requirements:
{json.dumps(requirements, indent=2)}

Return ONLY valid JSON.

Required JSON Schema:

{{
  "evidence_standard_met":"true|false",
  "evidence_standard_met_reason":"",
  "risk_flags":"semicolon separated flags or none",
  "issue_type":"dent|scratch|crack|glass_shatter|broken_part|missing_part|torn_packaging|crushed_packaging|water_damage|stain|none|unknown",
  "object_part":"",
  "claim_status":"supported|contradicted|not_enough_information",
  "claim_status_justification":"",
  "supporting_image_ids":["img_1"],
  "valid_image":"true|false",
  "severity":"none|low|medium|high|unknown"
}}

Rules:

1. Images are primary evidence.
2. User history only affects risk_flags.
3. If visible damage matches claim -> supported.
4. If claimed damage is not visible -> contradicted.
5. If images are insufficient -> not_enough_information.
6. Use issue_type=none if no damage exists.
7. Use unknown only if impossible to determine.
8. Keep explanations concise.
"""
# ============================================================
# GEMINI INFERENCE
# ============================================================

def analyze_claim(
    row,
    history_df,
    requirements_df
):

    history = get_user_history(
        row["user_id"],
        history_df
    )

    requirements = get_requirements(
        row["claim_object"],
        requirements_df
    )

    prompt = build_prompt(
        row["user_claim"],
        row["claim_object"],
        history,
        requirements
    )

    image_paths = parse_image_paths(
        row["image_paths"]
    )

    contents = [prompt]

    for image_path in image_paths:

        if not image_path.exists():
            raise FileNotFoundError(
                f"Missing image: {image_path}"
            )

        img = Image.open(image_path)

        contents.append(img)

    response = model.generate_content(
        contents,
        generation_config={
            "temperature": 0,
            "response_mime_type":
                "application/json"
        }
    )

    return json.loads(
        response.text
    )


# ============================================================
# OUTPUT BUILDERS
# ============================================================

def build_output_row(
    row,
    result
):

    supporting_ids = result.get(
        "supporting_image_ids",
        []
    )

    if isinstance(
        supporting_ids,
        str
    ):
        supporting_ids = [supporting_ids]

    return {
        "user_id":
            row["user_id"],

        "image_paths":
            row["image_paths"],

        "user_claim":
            row["user_claim"],

        "claim_object":
            row["claim_object"],

        "evidence_standard_met":
            result.get(
                "evidence_standard_met",
                "false"
            ),

        "evidence_standard_met_reason":
            result.get(
                "evidence_standard_met_reason",
                ""
            ),

        "risk_flags":
            result.get(
                "risk_flags",
                "none"
            ),

        "issue_type":
            result.get(
                "issue_type",
                "unknown"
            ),

        "object_part":
            result.get(
                "object_part",
                "unknown"
            ),

        "claim_status":
            result.get(
                "claim_status",
                "not_enough_information"
            ),

        "claim_status_justification":
            result.get(
                "claim_status_justification",
                ""
            ),

        "supporting_image_ids":
            ";".join(supporting_ids)
            if supporting_ids else "none",

        "valid_image":
            result.get(
                "valid_image",
                "false"
            ),

        "severity":
            result.get(
                "severity",
                "unknown"
            )
    }


def build_error_row(
    row,
    error
):

    return {
        "user_id":
            row["user_id"],

        "image_paths":
            row["image_paths"],

        "user_claim":
            row["user_claim"],

        "claim_object":
            row["claim_object"],

        "evidence_standard_met":
            "false",

        "evidence_standard_met_reason":
            str(error),

        "risk_flags":
            "manual_review_required",

        "issue_type":
            "unknown",

        "object_part":
            "unknown",

        "claim_status":
            "not_enough_information",

        "claim_status_justification":
            "processing failed",

        "supporting_image_ids":
            "none",

        "valid_image":
            "false",

        "severity":
            "unknown"
    }


# ============================================================
# MAIN
# ============================================================

def main():

    print("Loading datasets...")

    claims_df = load_claims()
    history_df = load_history()
    requirements_df = load_requirements()

    outputs = []

    total = len(claims_df)

    for idx, row in claims_df.iterrows():

        print(
            f"[{idx + 1}/{total}] "
            f"Processing {row['user_id']}"
        )

        try:

            result = analyze_claim(
                row,
                history_df,
                requirements_df
            )

            outputs.append(
                build_output_row(
                    row,
                    result
                )
            )

        except Exception as e:

            print(
                f"ERROR: {e}"
            )

            outputs.append(
                build_error_row(
                    row,
                    e
                )
            )

    output_df = pd.DataFrame(
        outputs,
        columns=OUTPUT_COLUMNS
    )

    output_df.to_csv(
        OUTPUT_FILE,
        index=False
    )

    print(
        f"\nDone!"
    )

    print(
        f"Output saved to:\n{OUTPUT_FILE}"
    )


if __name__ == "__main__":
    main()

