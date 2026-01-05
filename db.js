// db.js
const db = new Dexie("nailSizesDB");

db.version(1).stores({
  styles: "id, name",
  clients: "id, nameOrId, phone, email, createdAt, updatedAt",
  measurements: "id, clientId, styleId, updatedAt"
});

async function seedIfEmpty() {
  const styleCount = await db.styles.count();

  if (styleCount === 0) {
    const styles = [
      { id: "A", name: "A", minLabel: "0", maxLabel: "11", imageFile: "A.jpg" },
      { id: "B", name: "B", minLabel: "0", maxLabel: "9",  imageFile: "B.jpg" },
      { id: "C", name: "C", minLabel: "0", maxLabel: "9",  imageFile: "C.jpg" },
      { id: "D", name: "D", minLabel: "0", maxLabel: "9", imageFile: "D.jpg" },
      { id: "E", name: "E", minLabel: "0", maxLabel: "9",  imageFile: "E.jpg" },
      { id: "F", name: "F", minLabel: "0", maxLabel: "9",  imageFile: "F.jpg" }
    ];
    await db.styles.bulkAdd(styles);
  }
}
