module.exports = {
  content: { relative: true, files: ['./pages/k01/**/*.{jsx,html}', './src/knowledge-reuse/**/*.{ts,tsx}'] },
  theme: { extend: { colors: {
    brand: { 50:'#f0edff',100:'#e7e3ff',200:'#c9c1ff',500:'#5746f5',600:'#5746f5',700:'#4938e8',800:'#302391' },
    ink: { 50:'#f6f8fc',100:'#eef2f7',200:'#e3e8f1',300:'#b5c0d0',400:'#5f6f89',500:'#5f6f89',600:'#445571',700:'#263b5c',800:'#0f2347',900:'#0f2347' },
  }, fontFamily: { sans:['PingFang SC','Microsoft YaHei','sans-serif'] } } }, plugins: [],
};
