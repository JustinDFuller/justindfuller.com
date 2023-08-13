<!-- Simple script to hide main until fonts are loaded -->
<script>
  const main = document.querySelector("main");
  main.style.visibility = "hidden";
  document.fonts.ready.then(function () {
    main.style.visibility = "visible";
  });
</script>
