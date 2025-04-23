"use client";
import * as React from "react";
import { useState } from "react";
import styles from "./InputDesign.module.css";
import HeroSection from "./HeroSection";
import NavigationBar from "./NavigationBar";
import LocationModal from "./LocationModal";

function InputDesign() {
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [locations, setLocations] = useState({
    insidePotted: false,
    outsidePotted: false,
    outsideGround: false,
  });

  const toggleLocation = (locationId) => {
    setLocations((prev) => ({
      ...prev,
      [locationId]: !prev[locationId],
    }));
  };

  return (
    <div className={styles.pageContainer}>
      <header className={styles.headerFixed} />
      <main>
        <HeroSection />
        <NavigationBar onGetStarted={() => setShowLocationModal(true)} />
        {showLocationModal && (
          <LocationModal
            locations={locations}
            onToggleLocation={toggleLocation}
            onClose={() => setShowLocationModal(false)}
          />
        )}
      </main>
    </div>
  );
}

export default InputDesign;
