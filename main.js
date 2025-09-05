<!-- Simple script to hide main until fonts are loaded -->
<script>
  // Hide main content initially
  const main = document.querySelector("main");
  if (main) {
    main.style.visibility = "hidden";
  }
  
  // Show everything when fonts are ready (with timeout fallback)
  const showContent = () => {
    if (main) {
      main.style.visibility = "visible";
    }
  };
  
  // Show content when fonts are ready
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(showContent);
  } else {
    // Fallback for browsers that don't support font loading API
    showContent();
  }
  
  // Timeout fallback in case fonts fail to load
  setTimeout(showContent, 1000);
</script>