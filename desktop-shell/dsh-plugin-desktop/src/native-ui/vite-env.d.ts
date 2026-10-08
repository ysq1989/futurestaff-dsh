declare module '*.css' {
  const classes: Record<string, string>
  export default classes
}
declare module '*.svg?raw' {
  const svg: string
  export default svg
}
