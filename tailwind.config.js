module.exports = {
  darkMode: 'class',
  content: ['./src/index.template.html', './demo/index.html'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'Segoe UI', 'Microsoft YaHei', 'sans-serif'],
        mono: ['Cascadia Code', 'SFMono-Regular', 'Consolas', 'monospace']
      },
      boxShadow: {
        panel: '0 1px 2px rgba(16,24,40,.04),0 8px 24px rgba(16,24,40,.05)'
      }
    }
  },
  plugins: []
};
