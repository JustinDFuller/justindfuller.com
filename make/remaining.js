function handleSubmit(event) {
    event.preventDefault();

    const data = new FormData(document.getElementById("form"));
    
    process(data.get("birthdate"))

    try {
        window.localStorage.setItem("birthdate", data.get("birthdate"))
    } catch(e) {
        console.error("Cannot set local storage", e);
    }
}

function process(birthdate) {
    const birth = new Date(birthdate);
    const now = new Date();
    const diff = now.getTime() - birth.getTime();
    const age = Math.round(diff / (1000 * 60 * 60 * 24 * 365.25));
    const expected = (79 - age) * 52

    document.getElementById("age").innerText = age * 52;
    document.getElementById("remaining").innerText = expected;
    document.getElementById("percent").innerText = Math.round(((79 - age) / 79) * 100);
    document.getElementById("results").style.display = "block";
}

try {
    const birthdate = window.localStorage.getItem("birthdate");
    if (birthdate) {
        process(birthdate);
        document.getElementById("birthdate").value = birthdate;
    }
} catch(e) {
    console.error("Cannot get local storage", e);
}