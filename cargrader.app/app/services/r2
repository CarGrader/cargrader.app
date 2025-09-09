
import os
import io
from typing import Optional, List, Dict
import boto3
from botocore.config import Config
import botocore

R2_BUCKET = os.environ["R2_BUCKET"]
R2_ENDPOINT = os.environ["R2_ENDPOINT"]
R2_ACCESS_KEY_ID = os.environ["R2_ACCESS_KEY_ID"]
R2_SECRET_ACCESS_KEY = os.environ["R2_SECRET_ACCESS_KEY"]

_session = boto3.session.Session()
_s3 = _session.client(
    "s3",
    endpoint_url=R2_ENDPOINT,
    aws_access_key_id=R2_ACCESS_KEY_ID,
    aws_secret_access_key=R2_SECRET_ACCESS_KEY,
    region_name="auto",
    config=Config(
        s3={"addressing_style": "virtual"},
        signature_version="s3v4",
        retries={"max_attempts": 3, "mode": "standard"},
        connect_timeout=3,
        read_timeout=10,
    ),
)

class R2Error(Exception):
    pass

def get_bytes(key: str) -> bytes:
    try:
        resp = _s3.get_object(Bucket=R2_BUCKET, Key=key)
        return resp["Body"].read()
    except botocore.exceptions.ClientError as e:
        code = e.response.get("Error", {}).get("Code")
        if code in ("NoSuchKey", "404"):
            raise R2Error(f"Object not found: {key}") from e
        raise

def get_text(key: str, encoding: str = "utf-8") -> str:
    return get_bytes(key).decode(encoding, errors="replace")
