import pandas as pd
from sklearn.metrics import accuracy_score

expected = pd.read_csv(
    "dataset/sample_claims.csv"
)

predicted = pd.read_csv(
    "sample_output.csv"
)

acc = accuracy_score(
    expected["claim_status"],
    predicted["claim_status"]
)

print(
    f"Claim Status Accuracy: {acc:.4f}"
)