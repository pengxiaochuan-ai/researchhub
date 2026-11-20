import importlib.util,pathlib,tempfile,tarfile,io,unittest
s=importlib.util.spec_from_file_location('m',str(pathlib.Path(__file__).with_name('hub-runtime-artifacts.py')));m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
class Artifacts(unittest.TestCase):
 def test_source_is_pinned_to_the_hub_release_prefix(self):
  for key in ['other/file.tgz','releases/aisci/a/source.tar.gz','releases/researchhub/../secret','/releases/researchhub/a/source.tar.gz']:
   with self.assertRaises(ValueError):m.source_key(key)
  self.assertEqual(m.source_key('releases/researchhub/backend-demo-20261119-a/context.tar.gz'),'releases/researchhub/backend-demo-20261119-a/context.tar.gz')
 def test_extract_rejects_paths_links_and_special_files(self):
  for name,kind in [('../outside',tarfile.REGTYPE),('/absolute',tarfile.REGTYPE),('inside',tarfile.SYMTYPE),('inside',tarfile.LNKTYPE),('inside',tarfile.CHRTYPE)]:
   with tempfile.TemporaryDirectory() as d:
    p=pathlib.Path(d)/'archive.tar'
    with tarfile.open(p,'w') as out:
     item=tarfile.TarInfo(name);item.type=kind;item.size=0;item.linkname='/outside';out.addfile(item,io.BytesIO())
    with self.assertRaises(ValueError):m.extract_context(p,pathlib.Path(d)/'target')
    self.assertFalse((pathlib.Path(d)/'outside').exists())
 def test_extract_checks_bytes_before_materializing_any_member(self):
  with tempfile.TemporaryDirectory() as d:
   p=pathlib.Path(d)/'archive.tar'
   with tarfile.open(p,'w') as out:
    item=tarfile.TarInfo('./core/package.json');body=b'{}';item.size=len(body);out.addfile(item,io.BytesIO(body))
   with self.assertRaises(ValueError):m.verify_digest(p,'0'*64)
   m.extract_context(p,pathlib.Path(d)/'target')
   self.assertEqual((pathlib.Path(d)/'target/core/package.json').read_bytes(),b'{}')
 def test_collected_frontend_artifacts_match_the_existing_release_consumer(self):
  from unittest.mock import patch
  import types,os,json
  with tempfile.TemporaryDirectory() as d:
   root=pathlib.Path(d);out=root/'release';out.mkdir();context=root/'context';context.mkdir()
   (context/'release.json').write_text(json.dumps({'coreDigest':'a'*64,'hubDigest':'b'*64}))
   for name in ('researchhub.tar.gz','backend-image.tar.gz'):(out/name).write_bytes(b'synthetic archive')
   args=types.SimpleNamespace(directory=str(out),context=str(context),tag='hub-runtime-12345678-1',source_sha='c'*64)
   with patch.dict(os.environ,{'GITHUB_SHA':'d'*40,'HUB_TENANT_SLUG':'synthetic-hub'}),patch.object(m,'image_info',return_value={'id':'sha256:'+'f'*64,'architecture':'amd64'}):m.collect(args)
   names=[line.split('  ',1)[1] for line in (out/'ARTIFACTS.sha256').read_text().splitlines()]
   self.assertEqual(names,['researchhub.tar.gz','docker-compose.ecs.yml'])
   release=json.loads((out/'runtime-release.json').read_text());self.assertIn('researchhub.tar.gz',release['files']);self.assertFalse(release['workersEnabled'])
 def test_reused_backend_keeps_its_actual_reference_without_needing_a_rebuilt_context(self):
  from unittest.mock import patch
  import types,os,json
  with tempfile.TemporaryDirectory() as d:
   root=pathlib.Path(d)
   for name in ('researchhub.tar.gz','backend-image.tar.gz'):(root/name).write_bytes(b'original artifact bytes')
   previous={'coreDigest':'a'*64,'hubDigest':'b'*64}
   args=types.SimpleNamespace(directory=d,context=str(root/'absent'),tag='hub-runtime-12345678-1',source_sha='c'*64,backend_image='researchhub-backend:original-tag',backend_release=previous)
   with patch.dict(os.environ,{'GITHUB_SHA':'d'*40,'HUB_TENANT_SLUG':'synthetic-hub'}),patch.object(m,'image_info',return_value={'id':'sha256:'+'f'*64,'architecture':'amd64'}) as inspect:m.collect(args)
   release=json.loads((root/'runtime-release.json').read_text())
   self.assertEqual(release['backendImage'],args.backend_image);self.assertEqual(release['coreDigest'],previous['coreDigest']);self.assertEqual(release['hubDigest'],previous['hubDigest']);inspect.assert_any_call(args.backend_image)
 def test_private_backend_never_exports_an_actions_cache_or_build_record(self):
  text=pathlib.Path('.github/workflows/deploy.yml').read_text()
  backend=text.split('      - name: Build changed backend',1)[1].split('      - name: Reuse unchanged backend',1)[0]
  self.assertNotIn('cache-to:',backend);self.assertNotIn('cache-from:',backend)
  self.assertIn("DOCKER_BUILD_RECORD_UPLOAD: 'false'",text)
  self.assertIn('VITE_AUTH_TENANT_SLUG=${{ env.HUB_TENANT_SLUG }}',text)
if __name__=='__main__':unittest.main()
