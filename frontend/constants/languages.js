// The default is explicit rather than "whatever happens to be first", so
// reordering the selector can never silently change which language loads.
export const DEFAULT_LANGUAGE = "python"

// This order is what the selector shows; it matches the backend's own
// ordering (GET /health).
const languages = [
    { id: "python", label: "Python" },
    { id: "cpp", label: "C++" },
    { id: "java", label: "Java" },
];

export default languages;
