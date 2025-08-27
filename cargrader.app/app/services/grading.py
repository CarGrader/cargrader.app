# Put your log/exp or logistic grading math here
# Example: 75 + 15*log2(RelRatio), or your SigScore curve
import math

def score_from_relratio(relratio: float) -> float:
    if relratio <= 0:
        return 0.0
    return 75.0 + 15.0 * (math.log(relratio, 2))
