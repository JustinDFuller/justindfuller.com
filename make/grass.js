<script>
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/grass/service-worker.js');
  } 

  const main = document.querySelector("main");
  main.style.visibility = "hidden";
  document.fonts.ready.then(function () {
    main.style.visibility = "visible";
  });

  const week = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ];

  const grassTypes = [
    {
      name: "Bermuda",
      inches: 1,
    },
    {
      name: "Zoysia",
      inches: 0.75,
    },
    {
      name: "St. Augustine",
      inches: 1.25,
    },
    {
      name: "Kentucky Bluegrass",
      inches: 2.5,
    },
    {
      name: "Tall Fescue",
      inches: 1.5,
    },
    {
      name: "Ryegrass",
      inches: 1.25,
    },
    {
      name: "Fine Fescue",
      inches: 1,
    },
  ];

  const intro = document.getElementById("intro");
  const loading = document.getElementById("loading");
  const precipitation = document.getElementById("precipitation");
  const precipitationTotalInches = document.getElementById(
    "precipitationTotalInches"
  );

  const chooseGrassType = document.getElementById("chooseGrassType");
  const chooseGrassTypeSelect = document.getElementById(
    "chooseGrassTypeSelect"
  );

  const wateringNeeds = document.getElementById("wateringNeeds");
  const wateringNeedsAmount = document.getElementById(
    "wateringNeedsAmount"
  );
  const wateringMinutesEachDay = document.getElementById(
    "wateringMinutesEachDay"
  );
  const wateringDeficiency = document.getElementById("wateringDeficiency");

  const forecast = {};

  async function handleLocationClick() {
    intro.classList.add("hidden");
    loading.classList.remove("hidden");

    const location = await new Promise(function (resolve) {
      navigator.geolocation.getCurrentPosition(async (position) => {
        const location = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        };
        window.localStorage.setItem("location", JSON.stringify(location));
        resolve(location);
      });
    });

    renderForecast(location);
  }

  async function renderForecast(location) {
    intro.classList.add("hidden");
    loading.classList.remove("hidden");

    const point = await fetch(
      `https://api.weather.gov/points/${location.latitude},${location.longitude}`
    ).then((res) => res.json());

    const response = await fetch(point.properties.forecastGridData).then(
      (res) => res.json()
    );

    let total = 0;
    const days = {};

    for (const value of response.properties.quantitativePrecipitation
      .values) {
      total = (total * 100 + value.value * 100) / 100;

      const date = value.validTime.slice(0, 10);
      const parsed = new Date(
        Number(date.slice(0, 4)),
        Number(date.slice(5, 7)) - 1,
        Number(date.slice(8, 10))
      );

      const today = new Date()
      const sevenDays = new Date()
      sevenDays.setDate(today.getDate() + 7)
      if (parsed > sevenDays) {
        continue
      }

      let day = days[date];
      if (!day) {
        day = {
          date,
          day: week[parsed.getDay()],
          dayInt: parsed.getDay(),
          precipitationInches: 0,
          temperatureF: 0,
        };
      }
      day.precipitationInches += value.value / 25.4;
      days[date] = day;
    }

    for (const value of response.properties.maxTemperature.values) {
      const date = value.validTime.slice(0, 10);
      const parsed = new Date(
        Number(date.slice(0, 4)),
        Number(date.slice(5, 7)) - 1,
        Number(date.slice(8, 10))
      );

      const today = new Date()
      const sevenDays = new Date()
      sevenDays.setDate(today.getDate() + 7)
      if (parsed > sevenDays) {
        continue
      }

      let day = days[date];
      if (!day) {
        day = {
          date,
          day: week[parsed.getDay()],
          dayInt: parsed.getDay(),
          precipitationInches: 0,
          temperatureF: 0,
        };
      }
      day.temperatureF = Math.round((value.value * 1.8 + 32) * 100) / 100;
      days[date] = day;
    }

    total = Number(Math.round(total * 100) / 100).toFixed(2);

    const totalInches = (total / 25.4).toFixed(2);

    forecast.totalInches = totalInches;
    forecast.days = days;

    precipitationTotalInches.innerText = totalInches;
    precipitation.classList.remove("hidden");
    loading.classList.add("hidden");
    chooseGrassType.classList.remove("hidden");

    const selectedGrass = window.localStorage.getItem("grass") || "";
    if (selectedGrass) {
      chooseGrassTypeSelect.value = selectedGrass;
      handleGrassSelect({ value: selectedGrass });
    }
  }

  function handleGrassSelect(target) {
    const grass = grassTypes.find((g) => g.name === target.value);

    window.localStorage.setItem("grass", grass.name);
    const deficiency =
      Math.round((grass.inches - forecast.totalInches) * 100) / 100;
    const third = Math.round((deficiency / 3) * 100) / 100;

    wateringNeedsAmount.innerText = grass.inches;
    wateringMinutesEachDay.innerText = Math.round(60 * third);
    wateringDeficiency.innerText = deficiency;
    wateringNeeds.classList.remove("hidden");

    const sorted = Object.values(forecast.days).sort((a, b) => {
      if (a.precipitationInches === 0 && b.precipitationInches === 0) {
        return b.temperatureF - a.temperatureF;
      }
      return a.precipitationInches - b.precipitationInches
    }).map((val, index) => {
      if (index < 3) {
        val.willWater = true
      } else {
        val.willWater = false
      }

      return val
    })

    sorted.forEach(day => {
      forecast.days[day.date] = day

      if (day.willWater) {
        document
          .getElementById(day.day)
          .querySelector("input").checked = "checked"
      }
    })

    for (const date in forecast.days) {
      const day = forecast.days[date];

      const currentDay = new Date().getDay()

      let realDay = day.dayInt - currentDay
      if (realDay < 0) {
        realDay = 7 + realDay
      }

      document.getElementById(day.day).style.order = realDay

      if (day.dayInt === currentDay) {
        document
          .getElementById(day.day)
          .querySelector(".title").innerText = "Today"
      } else if (day.dayInt === (currentDay + 1)) {
        document
          .getElementById(day.day)
          .querySelector(".title").innerText = "Tomorrow"
      }

      document
        .getElementById(day.day)
        .querySelector(".rain").innerText = ( day.precipitationInches === 0 ? 0 : day.precipitationInches.toFixed(2)) + "in";

      document
        .getElementById(day.day)
        .querySelector(".temperature").innerText = day.temperatureF + "°F";

      document.getElementById("weekDays").classList.remove("hidden");
      document.getElementById("weekDayPrompt").classList.remove("hidden");
      document.getElementById("notifications").classList.remove("hidden");
    }
  }

  function handleWaterLawnCheck(event) {
    for (const date in forecast.days) {
      const day = forecast.days[date];

      if (day.day !== event.name) {
        continue;
      }

      day.willWater = event.checked;
    }
  }

  async function handleReminderClick() {
    const reg = await navigator.serviceWorker.getRegistration("/grass/service-worker.js");
    if (!reg) {
      alert("Unable to set up notifications.")
      console.error("Service worker not found")

      return
    }

    Notification.requestPermission().then(permission => {
      if (permission !== 'granted') {
        alert('Unable to set up notifications.');
        console.log("Permission not granted.", permission);

        return
      } else {
        reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: "BMhhlc_OBTiPkzt6sYneuv_kWlgWATUFANJr5x1PBWpT7eMeVHLcW-oIzhOrZiiTGRITeqGVAphu1dGEpT_tYG0",
        }).then((subscription) => {
          console.log({ subscription })
        });
      }
    }).catch((e) => {
      alert("Unable to set up notifications.")
      console.error("Unable to set up notifications", e)
    });
  }

  try {
    const location = window.localStorage.getItem("location");

    if (location) {
      parsed = JSON.parse(location);
      intro.classList.add("hidden");
      renderForecast(parsed);
    }
  } catch (e) {
    console.log(e);
  }
</script>
