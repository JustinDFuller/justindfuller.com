function handleSubmit(event) {
    event.preventDefault();

    const data = new FormData(document.getElementById("form"));

    const birth = new Date(data.get("year"), data.get("month"), data.get("day"));
    const now = new Date();
    const diff = now.getTime() - birth.getTime();
    const age = Math.round(diff / (1000 * 60 * 60 * 24 * 365.25));
    const expected = (79 - age) * 52

    document.getElementById("age").innerText = age * 52;
    document.getElementById("remaining").innerText = expected;
    document.getElementById("percent").innerText = Math.round(((79 - age) / 79) * 100);
    document.getElementById("results").style.display = "block";
}