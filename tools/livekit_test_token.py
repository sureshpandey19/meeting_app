#!/usr/bin/env python3
import argparse
import os
import sys
from datetime import datetime, timedelta

from dotenv import load_dotenv
from jose import jwt


def main() -> int:
    load_dotenv("backend/.env")

    api_key = os.getenv("LIVEKIT_API_KEY")
    api_secret = os.getenv("LIVEKIT_API_SECRET")
    if not api_key or not api_secret:
        print("Missing LIVEKIT_API_KEY or LIVEKIT_API_SECRET in backend/.env", file=sys.stderr)
        return 1

    parser = argparse.ArgumentParser(description="Generate a LiveKit test token.")
    parser.add_argument("--identity", required=True, help="Participant identity (unique string).")
    parser.add_argument("--room", required=True, help="Room name (e.g., meeting_123).")
    parser.add_argument("--name", default="", help="Display name (optional).")
    parser.add_argument("--ttl-minutes", type=int, default=15, help="Token TTL in minutes.")
    parser.add_argument("--publish", action="store_true", help="Allow publishing tracks.")
    parser.add_argument("--no-publish", dest="publish", action="store_false", help="Disallow publishing tracks.")
    parser.set_defaults(publish=True)
    args = parser.parse_args()

    expire = datetime.utcnow() + timedelta(minutes=args.ttl_minutes)
    claims = {
        "iss": api_key,
        "sub": args.identity,
        "name": args.name or args.identity,
        "exp": expire,
        "video": {
            "room": args.room,
            "roomJoin": True,
            "canPublish": bool(args.publish),
            "canSubscribe": True,
            "canPublishData": True,
        },
    }

    token = jwt.encode(claims, api_secret, algorithm="HS256")
    print(token)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
