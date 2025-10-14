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
DETAILS_SQL = """
SELECT
  ac.ModelYear      AS ModelYear,
  ac.Make           AS Make,
  ac.Model          AS Model,
  ac.GroupID        AS GroupID,
  SUM(ac.Count)    AS ComplaintCount,
  ac.RelRatio       AS RelRatio
FROM AllCars ac
WHERE ac.ModelYear = :year
  AND ac.Make      = :make
  AND ac.Model     = :model
GROUP BY ac.GroupID, ac.ModelYear, ac.Make, ac.Model, ac.RelRatio
ORDER BY (ac.Score IS NULL), ac.Score DESC
LIMIT 1
"""

# ---- Filtered Lookup SQL ----

FILTER_MAKES_RANGE_SQL = """
SELECT DISTINCT Make
FROM AllCars
WHERE ModelYear BETWEEN :min_year AND :max_year
ORDER BY Make
"""

# We'll format the IN(...) portion in the route.
FILTER_MODELS_RANGE_SQL_BASE = """
SELECT DISTINCT Model
FROM AllCars
WHERE ModelYear BETWEEN :min_year AND :max_year
  {makes_clause}
ORDER BY Model
"""

# We'll format the IN(...) portions + LIMIT in the route.
FILTER_SEARCH_SQL_BASE = """
SELECT
  ModelYear AS Year,
  Make,
  Model,
  MAX(Score) AS Score
FROM AllCars
WHERE ModelYear BETWEEN :min_year AND :max_year
  {makes_clause}
  {models_clause}
  {score_clause}
GROUP BY ModelYear, Make, Model
ORDER BY (MAX(Score) IS NULL), MAX(Score) DESC, Year DESC, Make ASC, Model ASC
LIMIT :limit
"""


