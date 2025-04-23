import React from "react";
import styles from "./InputDesign.module.css";

const LOCATION_OPTIONS = [
  {
    id: "insidePotted",
    label: "Inside Potted",
  },
  {
    id: "outsidePotted",
    label: "Outside Potted",
  },
  {
    id: "outsideGround",
    label: "Outside in the Ground",
  },
];

function LocationModal({ locations, onToggleLocation, onClose }) {
  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modalContent}>
        <button
          className={styles.closeButton}
          onClick={onClose}
          aria-label="Close modal"
        >
          ×
        </button>
        <h2 className={styles.modalTitle}>Where are your plants located?</h2>
        <div className={styles.locationOptions}>
          {LOCATION_OPTIONS.map((option) => (
            <label
              className={styles.locationOption}
              key={option.id}
              style={{
                backgroundColor: locations[option.id]
                  ? "rgb(197, 223, 170)"
                  : "white",
              }}
            >
              <input
                type="checkbox"
                className={styles.locationCheckbox}
                checked={locations[option.id]}
                onChange={() => onToggleLocation(option.id)}
              />
              <span className={styles.locationLabel}>{option.label}</span>
            </label>
          ))}
        </div>
        <button
          className={`${styles.button} ${styles.builderE84dcd7a082e4cf48c1286556fc2386e}`}
          onClick={onClose}
        >
          Continue
        </button>
      </div>
    </div>
  );
}

export default LocationModal;
