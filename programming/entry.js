// Programming entry page JavaScript
document.addEventListener('DOMContentLoaded', function() {
  // Add syntax highlighting for code blocks if needed
  const codeBlocks = document.querySelectorAll('pre code');
  codeBlocks.forEach(block => {
    // Add line numbers to code blocks
    const lines = block.textContent.split('\n');
    if (lines.length > 1) {
      block.classList.add('has-line-numbers');
    }
  });

  // Add copy button to code blocks
  document.querySelectorAll('pre').forEach(pre => {
    const button = document.createElement('button');
    button.textContent = 'Copy';
    button.className = 'copy-code-button';
    button.style.cssText = 'position: absolute; top: 8px; right: 8px; padding: 4px 8px; background: var(--color-bg-tertiary); border: 1px solid var(--color-border); border-radius: var(--border-radius-sm); color: var(--color-text-secondary); cursor: pointer; font-size: var(--font-size-xs);';
    
    pre.style.position = 'relative';
    pre.appendChild(button);
    
    button.addEventListener('click', async () => {
      const code = pre.querySelector('code').textContent;
      try {
        await navigator.clipboard.writeText(code);
        button.textContent = 'Copied!';
        setTimeout(() => {
          button.textContent = 'Copy';
        }, 2000);
      } catch (err) {
        console.error('Failed to copy:', err);
      }
    });
  });

  // Add smooth scroll for anchor links
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
      e.preventDefault();
      const target = document.querySelector(this.getAttribute('href'));
      if (target) {
        target.scrollIntoView({
          behavior: 'smooth',
          block: 'start'
        });
      }
    });
  });
});