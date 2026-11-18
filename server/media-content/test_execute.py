import unittest,importlib.util,json,tempfile,hashlib
from pathlib import Path
spec=importlib.util.spec_from_file_location('media_executor',Path(__file__).with_name('execute.py'));m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
root=Path(__file__).resolve().parents[2];fixtures=root/'.tmp/ai-media-content-2026-11-17'
class Contract(unittest.TestCase):
 def request(self,path):return {'sourceSha256':m.sha(path),'sourceVersion':2,'configHash':'c'*64}
 def test_only_whole_json_fence_is_normalized(self):
  self.assertEqual(m.parse_json_reply('```json\n{"frames": []}\n```'),{'frames':[]})
  with self.assertRaises(json.JSONDecodeError):m.parse_json_reply('ignore this ```json\n{}\n```')
 def test_real_late_audio_manifest(self):
  p=fixtures/'synthetic.mp4';manifest,pts=m.manifest(p,self.request(p));self.assertEqual(manifest['timelineOriginUs'],'0');self.assertEqual(manifest['audioOffsetUs'],'1136000');self.assertTrue(len(pts)>3)
 def test_nonzero_rejected_and_original_untouched(self):
  p=fixtures/'nonzero-pts.mp4';before=m.sha(p)
  with self.assertRaisesRegex(RuntimeError,'TIMELINE_UNSUPPORTED'):m.manifest(p,self.request(p))
  self.assertEqual(m.sha(p),before)
 def test_source_digest_rejected(self):
  p=fixtures/'synthetic.mp4'
  with self.assertRaisesRegex(RuntimeError,'SOURCE_VERSION'):m.manifest(p,{'sourceSha256':'0'*64})
 def test_silence_gates_actual_asr(self):
  with tempfile.TemporaryDirectory(prefix='rh-mc-silence-') as d:
   p=Path(d)/'silent.mp4';m.run(['/opt/homebrew/bin/ffmpeg','-nostdin','-v','error','-f','lavfi','-i','color=c=black:s=320x180:r=25:d=2','-f','lavfi','-i','anullsrc=r=16000:cl=mono','-t','2','-c:v','libx264','-pix_fmt','yuv420p','-c:a','aac','-y',str(p)])
   manifest,_=m.manifest(p,self.request(p));e,status,usage,reason=m.audio_output(p,Path(d),manifest,{})
   self.assertEqual((e,status,usage['requests'],reason),([],'not_applicable',0,'no_speech'))
 def test_no_audio_never_invokes_asr(self):
  p=fixtures/'no-audio.mp4';manifest,_=m.manifest(p,self.request(p));e,status,usage,reason=m.audio_output(p,Path(tempfile.gettempdir()),manifest,{})
  self.assertEqual((e,status,usage['requests'],reason),([],'not_applicable',0,'no_audio'))
if __name__=='__main__':unittest.main()
