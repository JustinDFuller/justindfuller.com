import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { runInNewContext } from "node:vm";

const source = readFileSync("make/grass.js", "utf8");

function harness(registrations = []) {
  const elements = new Map();
  const element = (id) => {
    if (!elements.has(id)) {
      const classes = new Set(["hidden"]);
      elements.set(id, {
        style: {},
        classList: {
          add: (name) => classes.add(name),
          remove: (name) => classes.delete(name),
          contains: (name) => classes.has(name),
        },
        querySelector: (selector) => element(`${id}:${selector}`),
      });
    }
    return elements.get(id);
  };
  const requests = [];
  const values = new Map();
  const context = {
    URL,
    console,
    navigator: {
      serviceWorker: { getRegistrations: async () => registrations },
    },
    document: {
      fonts: { ready: Promise.resolve() },
      querySelector: element,
      getElementById: element,
    },
    window: {
      localStorage: {
        getItem: (key) => values.get(key),
        setItem: (key, value) => values.set(key, value),
      },
    },
    fetch: async (url) => {
      requests.push(url);
      if (url.includes("/points/"))
        return {
          json: async () => ({
            properties: { forecastGridData: "https://api.weather.gov/grid" },
          }),
        };
      const date = new Date().toISOString().slice(0, 10);
      return {
        json: async () => ({
          properties: {
            quantitativePrecipitation: {
              values: [{ value: 12.7, validTime: `${date}T00:00:00Z/PT24H` }],
            },
            maxTemperature: {
              values: [{ value: 25, validTime: `${date}T00:00:00Z/PT24H` }],
            },
          },
        }),
      };
    },
  };
  runInNewContext(source, context);
  return { context, element, requests };
}

test("Grass computes rainfall and watering without reminder requests", async () => {
  const { context, element, requests } = harness();
  await context.renderForecast({ latitude: 39, longitude: -77 });
  context.handleGrassSelect({ value: "Bermuda" });
  assert.equal(element("precipitationTotalInches").innerText, "0.50");
  assert.equal(element("wateringDeficiency").innerText, 0.5);
  assert.equal(element("wateringMinutesEachDay").innerText, 10);
  assert.equal(element("wateringNeeded").classList.contains("hidden"), false);
  assert.deepEqual(requests, [
    "https://api.weather.gov/points/39,-77",
    "https://api.weather.gov/grid",
  ]);
});

test("Grass removes only its obsolete subscription and worker", async () => {
  const removed = [];
  const registration = (name, script) => ({
    active: { scriptURL: `https://example.com${script}` },
    pushManager: {
      getSubscription: async () => ({
        unsubscribe: async () => removed.push(`${name}:subscription`),
      }),
    },
    unregister: async () => removed.push(`${name}:worker`),
  });
  harness([
    registration("grass", "/grass/worker.js"),
    registration("other", "/other/worker.js"),
  ]);
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(removed, ["grass:subscription", "grass:worker"]);
});
