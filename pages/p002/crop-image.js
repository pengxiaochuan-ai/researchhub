import {whenSectionNear} from './section-images.js';
// The seven reference sheets are shared by many precision crops. Native lazy
// loading observes the negatively positioned sheet, not its visible window.
export function loadCropImage(image, frame, source, status, dimensions) {
  const setState = state => {
    frame.dataset.imageState = state;
    frame.setAttribute('aria-busy', String(state === 'loading'));
    if (status) {
      status.hidden = state === 'loaded';
      status.textContent = state === 'error'
        ? '图片暂未加载，请刷新页面重试'
        : state === 'loading' ? '图片加载中' : '';
    }
  };
  image.width = dimensions?.width??1586;
  image.height = dimensions?.height??992;
  image.loading = 'eager';
  image.decoding = 'async';
  image.addEventListener('load', () => setState('loaded'), {once: true});
  image.addEventListener('error', () => setState('error'), {once: true});
  setState('loading');
  const load=()=>{image.src=source;if(image.complete)setState(image.naturalWidth>0?'loaded':'error');};
  if(dimensions)whenSectionNear(frame,load);else load();
}
