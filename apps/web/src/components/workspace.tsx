"use client";
import { useEffect, useState } from "react";
import type { Capabilities, Mode } from "@wayward/contracts";
import { api } from "../lib/api-client";
const modes: { id: Mode; label: string }[] = [
  { id: "flight", label: "Flights" },
  { id: "rail", label: "Trains" },
  { id: "coach", label: "Coaches" },
  { id: "ferry", label: "Ferries" },
  { id: "local_transit", label: "Local transit" },
  { id: "walking", label: "Walking" },
  { id: "transfer", label: "Transfers" },
];
export function Workspace() {
  const [selected, setSelected] = useState<Mode[]>(modes.map((m) => m.id));
  const [state, setState] = useState<
    "loading" | "empty" | "unavailable" | "error"
  >("loading");
  const [capabilities, setCapabilities] = useState<Capabilities | null>(null);
  const [message, setMessage] = useState("");
  function inspect() {
    setState("loading");
    api
      .capabilities()
      .then((c) => {
        setCapabilities(c);
        setState(
          c.providers.some((p) => p.operations.search === "available")
            ? "empty"
            : "unavailable",
        );
      })
      .catch(() => {
        setState("error");
        setMessage("We could not check supplier availability. Try again.");
      });
  }
  useEffect(() => {
    let active = true;
    api
      .capabilities()
      .then((c) => {
        if (active) {
          setCapabilities(c);
          setState(
            c.providers.some((p) => p.operations.search === "available")
              ? "empty"
              : "unavailable",
          );
        }
      })
      .catch(() => {
        if (active) {
          setState("error");
          setMessage("We could not check supplier availability. Try again.");
        }
      });
    return () => {
      active = false;
    };
  }, []);
  return (
    <>
      <header className="topbar">
        <a href="/" className="brand" aria-label="Wayward home">
          wayward<span>?</span>
        </a>
        <span className="header-note">EUROPE. EVERY WHICH WAY.</span>
        <nav aria-label="Main navigation">
          <a href="#workspace">
            My trip <span className="count">0</span>
          </a>
          <a href="#account">Orders & account ?</a>
        </nav>
      </header>
      <main>
        <section className="intro">
          <div>
            <p className="eyebrow">TAKE THE INTERESTING ROUTE</p>
            <h1>
              Go your own way<span>.</span>
            </h1>
            <p className="lede">
              Flights, trains, coaches, ferries. And the bits in between.
              <br />
              Bring the whole journey together, without the guesswork.
            </p>
          </div>
          <div className="route-art" aria-hidden="true">
            <span>ANYWHERE</span>
            <div>
              ? ????? ?<br />
              ?????
              <br />
              ???? ? ??? ?
            </div>
            <span>YOUR WAY</span>
          </div>
        </section>
        <section className="search-panel" aria-labelledby="search-title">
          <div className="section-heading">
            <h2 id="search-title">Where are we going?</h2>
            <span>01 / FIND YOUR ROUTE</span>
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setMessage(
                "Place lookup and supplier search are not connected yet. No offers have been requested.",
              );
            }}
          >
            <div className="fields">
              <label>
                From
                <input
                  name="origin"
                  required
                  placeholder="City, airport, station or port"
                  autoComplete="off"
                />
              </label>
              <label>
                To
                <input
                  name="destination"
                  required
                  placeholder="Somewhere worth going"
                  autoComplete="off"
                />
              </label>
              <label>
                Depart
                <input name="departure" type="date" required />
              </label>
              <label>
                Return <span className="optional">optional</span>
                <input name="return" type="date" />
              </label>
              <label>
                Travellers
                <input
                  name="travellers"
                  type="number"
                  min="1"
                  max="20"
                  defaultValue="1"
                  required
                />
              </label>
            </div>
            <fieldset>
              <legend>Keep your options open</legend>
              <div className="mode-list">
                {modes.map((m) => (
                  <label
                    key={m.id}
                    className={selected.includes(m.id) ? "mode active" : "mode"}
                  >
                    <input
                      type="checkbox"
                      checked={selected.includes(m.id)}
                      onChange={() =>
                        setSelected((s) =>
                          s.includes(m.id)
                            ? s.filter((id) => id !== m.id)
                            : [...s, m.id],
                        )
                      }
                    />
                    {m.label}
                  </label>
                ))}
              </div>
            </fieldset>
            <details>
              <summary>Passenger ages, bags & preferences</summary>
              <div className="fields advanced">
                <label>
                  Lead traveller age
                  <input type="number" min="0" max="120" defaultValue="30" />
                </label>
                <label>
                  Cabin bags
                  <input type="number" min="0" defaultValue="1" />
                </label>
                <label>
                  Checked bags
                  <input type="number" min="0" defaultValue="0" />
                </label>
                <label>
                  Discount card
                  <input placeholder="Scheme or card name" />
                </label>
                <label>
                  Priority
                  <select defaultValue="cheapest">
                    <option value="cheapest">Lowest total price</option>
                    <option value="fastest">Shortest journey</option>
                    <option value="comfortable">Most comfortable</option>
                  </select>
                </label>
              </div>
              <p className="muted">
                Per-passenger details and discount verification will be
                collected when search is connected.
              </p>
            </details>
            <div className="search-bottom">
              <label className="natural">
                Or put it in your own words
                <input
                  placeholder="A long weekend by the sea, fewer airports please?"
                  maxLength={4000}
                />
              </label>
              <button
                className="primary"
                type="submit"
                disabled={state === "loading" || selected.length === 0}
              >
                Find my way <span>?</span>
              </button>
            </div>
          </form>
          <p role="status" aria-live="polite" className="status">
            {message ||
              (state === "loading"
                ? "Checking supplier connections?"
                : state === "unavailable"
                  ? "Supplier connections are not ready. Nothing here is available to book yet."
                  : state === "error"
                    ? "Availability check failed."
                    : "Choose a route to begin.")}
          </p>
          {state === "error" && (
            <button type="button" onClick={inspect}>
              Retry connection check
            </button>
          )}
        </section>
        <div className="workspace-grid">
          <section className="results" aria-labelledby="options-title">
            <div className="section-heading">
              <h2 id="options-title">Your options</h2>
              <span>THE WHOLE PICTURE</span>
            </div>
            <div className="comparison">
              {["Cheapest", "Fastest", "Most comfortable"].map((label, i) => (
                <div key={label}>
                  <span className="muted">0{i + 1}</span>
                  <h3>{label}</h3>
                  <p>Waiting for real offers</p>
                  <strong>?</strong>
                </div>
              ))}
            </div>
            <div className="empty">
              <span className="empty-icon" aria-hidden="true">
                ?
              </span>
              <h3>A little wayfinding starts here.</h3>
              <p>
                When suppliers are connected, compare complete journeys, clear
                totals and transfer details here. No invented fares. No mystery
                tickets.
              </p>
              <span className="tag">LIVE INVENTORY NOT CONNECTED</span>
            </div>
          </section>
          <aside id="workspace">
            <div className="section-heading">
              <h2>Your trip</h2>
              <span>0 LEGS</span>
            </div>
            <div className="timeline">
              <div>
                <span className="dot" />
                Start somewhere
              </div>
              <div>
                <span className="dot" />
                Make the connections
              </div>
              <div>
                <span className="dot" />
                End up somewhere good
              </div>
            </div>
            <p>
              Add an offer to build your journey. We?ll check prices and
              availability again before checkout.
            </p>
            <div className="total">
              <span>Trip total</span>
              <strong>Unknown</strong>
            </div>
            <button disabled className="checkout">
              Continue to checkout ?
            </button>
            <p className="fine">
              A timetable is not a reservation. A payment is not a ticket.
            </p>
          </aside>
        </div>
        <section id="account" className="account">
          <div>
            <p className="eyebrow">EVERYTHING IN ITS PLACE</p>
            <h2>Orders, tickets & the next bit.</h2>
            <p>
              Order lookup and account access are not connected yet. No customer
              orders are stored in this foundation.
            </p>
          </div>
          <span className="tag">COMING INTO VIEW</span>
        </section>
        <footer>
          <span className="brand">wayward?</span>
          <span>Good trips. Straight answers.</span>
          <span>
            {capabilities?.environment ?? "Checking environment"} ? Contract v1
          </span>
        </footer>
      </main>
    </>
  );
}
