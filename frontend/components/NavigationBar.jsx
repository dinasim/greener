import React from "react";
import styles from "./InputDesign.module.css";

function NavigationBar({ onGetStarted }) {
  return (
    <nav className={styles.nav}>
      <a href="/" className={styles.logo} />
      <div className={styles.navActions}>
        <a className={styles.loginLink}>Log in</a>
        <button
          className={`${styles.button} ${styles.builder223e5e412b0244be83c6887592f15322}`}
          onClick={onGetStarted}
        >
          Get Started
        </button>
      </div>
    </nav>
  );
}

export default NavigationBar;
