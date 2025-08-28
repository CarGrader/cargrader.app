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
  gg.Count          AS ComplaintCount,
  gg.RelRatio       AS RelRatio
FROM AllCars ac
JOIN Grade_GID gg
  ON gg.GroupID = ac.GroupID
WHERE ac.ModelYear = :year
  AND ac.Make      = :make
  AND ac.Model     = :model
ORDER BY (ac.Score IS NULL), ac.Score DESC
LIMIT 1
"""

