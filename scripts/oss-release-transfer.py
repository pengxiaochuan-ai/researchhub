#!/usr/bin/env python3
"""Transfer researchhub release artifacts to or from Aliyun OSS.

Compatible with the Python 3 runtime bundled with Alibaba Cloud Linux.
"""
from __future__ import print_function

import argparse
import os


def _env(*names):
    for name in names:
        value = os.environ.get(name, "").strip()
        if value:
            return value
    raise SystemExit("missing env: one of {0}".format(", ".join(names)))


def _endpoint(raw):
    value = (raw or _env("OSS_ENDPOINT", "S3_ENDPOINT")).strip()
    value = value.replace("https://", "").replace("http://", "").rstrip("/")
    if not value:
        raise SystemExit("empty OSS endpoint")
    return value


def _bucket(endpoint):
    import oss2

    auth = oss2.Auth(
        _env("OSS_ACCESS_KEY", "S3_ACCESS_KEY"),
        _env("OSS_SECRET_KEY", "S3_SECRET_KEY"),
    )
    return oss2.Bucket(
        auth,
        "https://{0}".format(endpoint),
        _env("OSS_BUCKET", "S3_BUCKET"),
    )


def upload(args):
    import oss2

    endpoint = _endpoint(args.endpoint)
    bucket = _bucket(endpoint)
    print(
        "upload {0} -> oss://{1}/{2} (endpoint={3})".format(
            args.file, bucket.bucket_name, args.key, endpoint
        )
    )
    oss2.resumable_upload(
        bucket,
        args.key,
        args.file,
        multipart_threshold=50 * 1024 * 1024,
        part_size=16 * 1024 * 1024,
        num_threads=4,
    )
    print("upload ok")


def download(args):
    import oss2

    endpoint = _endpoint(args.endpoint)
    bucket = _bucket(endpoint)
    parent = os.path.dirname(args.file)
    if parent and not os.path.isdir(parent):
        os.makedirs(parent)
    print(
        "download oss://{0}/{1} -> {2} (endpoint={3})".format(
            bucket.bucket_name, args.key, args.file, endpoint
        )
    )
    oss2.resumable_download(
        bucket,
        args.key,
        args.file,
        multiget_threshold=50 * 1024 * 1024,
        part_size=16 * 1024 * 1024,
        num_threads=4,
    )
    print("download ok")


def main():
    parser = argparse.ArgumentParser(description="researchhub OSS release transfer")
    subcommands = parser.add_subparsers(dest="command")

    for name, handler in (("upload", upload), ("download", download)):
        command = subcommands.add_parser(name)
        command.add_argument("--file", required=True)
        command.add_argument("--key", required=True)
        command.add_argument("--endpoint", default=None)
        command.set_defaults(handler=handler)

    args = parser.parse_args()
    if not getattr(args, "command", None):
        parser.error("choose upload or download")
    args.handler(args)


if __name__ == "__main__":
    main()
