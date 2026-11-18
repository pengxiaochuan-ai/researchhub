import React, {useState} from 'react';
import {createRoot} from 'react-dom/client';
import {Button} from '../../pages/shared/Components.jsx';

function Fixture() {
  const [clicks,setClicks]=useState(0);
  const [submits,setSubmits]=useState(0);
  const [loading,setLoading]=useState(false);
  const [disabled,setDisabled]=useState(false);
  return <main>
    <h1>真实共享 Button 浏览器契约夹具（仅测试）</h1>
    <form onSubmit={e=>{e.preventDefault();setSubmits(n=>n+1);}}>
      <Button onClick={()=>setClicks(n=>n+1)}>普通操作</Button>
      <Button type="submit">提交操作</Button>
      <Button disabled onClick={()=>setClicks(n=>n+100)}>禁止操作</Button>
      <Button loading={loading} disabled={disabled} onClick={()=>{setClicks(n=>n+1);setLoading(true);}}>异步操作</Button>
    </form>
    <button onClick={()=>setLoading(false)}>模拟失败恢复</button>
    <button onClick={()=>setDisabled(v=>!v)}>切换独立禁用</button>
    <output id="clicks">{clicks}</output><output id="submits">{submits}</output>
  </main>;
}
createRoot(document.getElementById('root')).render(<Fixture/>);
