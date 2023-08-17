// Simple script to hide main until fonts are loaded
const main = document.querySelector("main");
main.style.visibility = "hidden";
document.fonts.ready.then(() => {
	main.style.visibility = "visible";
});
