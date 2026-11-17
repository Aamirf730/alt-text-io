import styles from "./examples.module.css";

type TableProps = {
  caption: string;
  headings: readonly string[];
  rows: readonly (readonly string[])[];
};

export default function ArticleTable({ caption, headings, rows }: TableProps) {
  return (
    <table className={styles.table}>
      <caption>{caption}</caption>
      <thead>
        <tr>{headings.map((heading) => <th scope="col" key={heading}>{heading}</th>)}</tr>
      </thead>
      <tbody>
        {rows.map(([label, ...cells]) => (
          <tr key={label}>
            <th scope="row">{label}</th>
            {cells.map((cell, index) => <td key={headings[index + 1]}>{cell}</td>)}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
