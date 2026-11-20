"""Start the Hub-owned parser or vector dependency; never downloads models."""
import argparse
import importlib.util
import os
from pathlib import Path
import socket
import json
from verify_model import verify


def main():
    cli = argparse.ArgumentParser()
    cli.add_argument('service', choices=['parser', 'embedding'])
    cli.add_argument('--host', default='127.0.0.1')
    cli.add_argument('--port', type=int, required=True)
    args = cli.parse_args()
    os.environ.update(HF_HUB_OFFLINE='1', HF_HUB_DISABLE_TELEMETRY='1', TOKENIZERS_PARALLELISM='false')

    def denied(*_args, **_kwargs):
        raise RuntimeError('HUB_KNOWLEDGE_DEPENDENCY_OUTBOUND_DENIED')

    socket.socket.connect = denied
    socket.socket.connect_ex = denied
    socket.create_connection = denied
    source = Path(__file__).with_name(args.service + '.py')
    spec = importlib.util.spec_from_file_location('hub_' + args.service, source)
    service = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(service)
    if args.service == 'embedding':
        from fastembed import TextEmbedding
        options = dict(model_name=service.MODEL, threads=1, local_files_only=True)
        if os.environ.get('KB_EMBED_MODEL_PATH'):
            model = Path(os.environ['KB_EMBED_MODEL_PATH']).resolve(strict=True)
            verify(model, json.loads(Path(__file__).with_name('model.json').read_text()))
            options.update(specific_model_path=str(model), cache_dir=str(model.parent))
        service._model = TextEmbedding(**options)
    import uvicorn
    uvicorn.run(service.app, host=args.host, port=args.port, access_log=False, log_level='error')


if __name__ == '__main__':
    main()
