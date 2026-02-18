import pkg from "../../package.json";

export const handler = async () => {
  return {
    statusCode: 200,
    body: JSON.stringify({ version: pkg.version }),
  };
};
