"use client";

import { useEffect, useState } from "react";
import "./WeeklyBaitBanner.css";

type WeeklyBait = {
  baitName: string;
  colour: string;
  description: string;
  price: string;
  imageUrl: string;
  buttonText: string;
  buttonLink: string;
};

const fallbackBait: WeeklyBait = {
  baitName: 'APACHE STICK 4"',
  colour: "BLACK MAGIC",
  description:
    "This week’s featured bait. Built for confident bites, dirty water, structure, and proper bass hunting.",
  price: "R50",
  imageUrl: "/images/weekly-bait.png",
  buttonText: "SHOP THIS BAIT",
  buttonLink: "/baits",
};

export default function WeeklyBaitBanner() {
  const [bait, setBait] = useState<WeeklyBait>(fallbackBait);

  useEffect(() => {
    async function loadWeeklyBait() {
      try {
        const response = await fetch("/api/weekly-bait", {
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error("Could not load weekly bait");
        }

        const data = await response.json();

        setBait({
          baitName: data.baitName || fallbackBait.baitName,
          colour: data.colour || fallbackBait.colour,
          description: data.description || fallbackBait.description,
          price: data.price || fallbackBait.price,
          imageUrl: data.imageUrl || fallbackBait.imageUrl,
          buttonText: data.buttonText || fallbackBait.buttonText,
          buttonLink: data.buttonLink || fallbackBait.buttonLink,
        });
      } catch (error) {
        console.error("Weekly bait banner error:", error);
        setBait(fallbackBait);
      }
    }

    loadWeeklyBait();
  }, []);

  return (
    <section className="weekly-bait-section">
      <div className="weekly-bait-card">
        <div className="weekly-bait-glow" />

        <div className="weekly-bait-content">
          <div className="weekly-bait-left">
            <div className="weekly-bait-tag">
              <span>▣</span>
              WEEKLY BAIT DROP
            </div>

            <h2>{bait.baitName}</h2>
            <h3>{bait.colour}</h3>

            <p>{bait.description}</p>

            <div className="weekly-bait-actions">
              <a href={bait.buttonLink} className="weekly-bait-button">
                {bait.buttonText}
                <span>›</span>
              </a>

              <div className="weekly-bait-price">
                <strong>{bait.price}</strong>
                <span>/ packet</span>
              </div>
            </div>
          </div>

          <div className="weekly-bait-right">
            <div className="weekly-product-stage">
              <img
                src={bait.imageUrl}
                alt={`${bait.baitName} ${bait.colour}`}
                referrerPolicy="no-referrer"
              />
            </div>
          </div>
        </div>

        <div className="weekly-bait-features">
          <div>
            <span className="feature-icon crosshair-icon">
              <span></span>
            </span>
            <strong>BUILT TO HUNT</strong>
            <small>Serious baits for serious anglers.</small>
          </div>

          <div>
            <span className="feature-icon">🐟</span>
            <strong>CONFIDENT BITES</strong>
            <small>Irresistible action. More hook ups.</small>
          </div>

          <div>
            <span className="feature-icon branch-icon">
              <span></span>
            </span>
            <strong>STRUCTURE READY</strong>
            <small>Made to fish heavy cover.</small>
          </div>
        </div>
      </div>
    </section>
  );
}