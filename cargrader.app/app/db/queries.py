YEARS_SQL = """
SELECT DISTINCT ModelYear
FROM AllCars
WHERE ModelYear IS NOT NULL
ORDER BY ModelYear
"""

MAKES_SQL = """
SELECT DISTINCT Make
FROM AllCars
WHERE ModelYear = :year
ORDER BY Make
"""

MODELS_SQL = """
SELECT DISTINCT Model
FROM AllCars
WHERE ModelYear = :year AND Make = :make
ORDER BY Model
"""

SCORE_SQL = """
SELECT Score, Certainty, GroupID
FROM AllCars
WHERE ModelYear = :year AND Make = :make AND Model = :model
ORDER BY (Score IS NULL), Score DESC
LIMIT 1
"""
