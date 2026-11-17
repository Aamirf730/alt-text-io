import type { ReactNode } from "react";
import Image from "next/image";
import CopyHtml from "./CopyHtml";
import styles from "./examples.module.css";

export type Example = {
  title: string;
  context: string;
  weak: string;
  better: string;
  why: string;
  image: {
    src: string;
    width: number;
    height: number;
    photo?: boolean;
  };
  background?: boolean;
  visibleLabel?: string;
  html?: string;
};

export default function ExampleCard({ example, children }: { example: Example; children?: ReactNode }) {
  const { title, context, weak, better, why, image, background, visibleLabel, html } = example;
  const photo = image.photo === true;

  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>
        <h3>{title}</h3>
        <p>{context}</p>
      </div>
      {background ? (
        <div className={styles.backgroundExample}>
          <div className={styles.backgroundImage} style={{ backgroundImage: `url(${image.src})`, aspectRatio: `${image.width} / ${image.height}` }} />
          <p>{better}</p>
        </div>
      ) : (
        <div className={photo ? styles.photo : styles.illustration}>
          <Image
            src={image.src}
            alt={better}
            width={image.width}
            height={image.height}
            sizes={photo ? "(max-width: 800px) calc(100vw - 2.5rem), 800px" : undefined}
          />
          {visibleLabel && <span className={styles.visualLabel}>{visibleLabel}</span>}
        </div>
      )}
      <div className={styles.cardBody}>
        <dl className={styles.comparison}>
          <div className={styles.weak}>
            <dt><span aria-hidden="true">✕</span> Weak</dt>
            <dd>{weak}</dd>
          </div>
          <div className={styles.better}>
            <dt><span aria-hidden="true">✓</span> {background ? "Better page text" : "Better"}</dt>
            <dd>{better || <code>{'alt=""'}</code>}</dd>
          </div>
        </dl>
        <p className={styles.why}>{why}</p>
        {children}
        {html && <CopyHtml html={html} />}
      </div>
    </div>
  );
}
