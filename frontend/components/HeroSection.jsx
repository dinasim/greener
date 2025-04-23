import React from "react";
import styles from "./InputDesign.module.css";

function HeroSection() {
  return (
    <section className={styles.heroSection}>
      <div className={styles.heroContent}>
        <h1 className={styles.heroTitle}>
          <span className={styles.brandName}>Greener</span>
          <span className={styles.tagline}>
            Your plants deserve better care
          </span>
        </h1>
        <p className={styles.heroDescription}>
          Smart reminders, expert care guides, and plant identification to help
          your green friends thrive.
          <br />
          Never forget to water your plants again.
        </p>
        <div className={styles.ctaContainer} />
      </div>
      <div className={styles.heroImage} />
    </section>
  );
}

export default HeroSection;
