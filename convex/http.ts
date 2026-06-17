import { httpRouter } from "convex/server";
import { auth } from "./auth";

const http = httpRouter();

// Adds /.well-known/openid-configuration and /.well-known/jwks.json used by
// Convex Auth for JWT verification.
auth.addHttpRoutes(http);

export default http;
