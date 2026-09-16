import type {
  CoachRequest, CoachResponse, CreateLabRequest, CreateLabResponse, GetLabResponse,
  GradeRequest, GradeResponse, PatchLabRequest, PatchLabResponse, PostEventsRequest,
  PostEventsResponse, PredictRequest, PredictResponse, RecapResponse, RemixRequest,
  RemixResponse, SessionId,
} from "@instinct/lab-schema";
import { NotImplemented, type Result } from "@instinct/shared";

/**
 * Typed client for the API in docs/05. Every method's request and response type comes from
 * lab-schema, so a contract change breaks the build rather than the running app.
 *
 * Rules that are easy to get wrong (doc 05 §Client transport rules):
 *  - `postEvents` is FIRE-AND-FORGET. Never await it in an input handler; use `keepalive`.
 *  - Never poll `getLab` while the stream is open. It is for cold load and after a 409 only.
 *  - Every mutating call carries the last known `rev`; on 409, refetch and reapply.
 *  - AbortController on everything, aborted on unmount.
 *  - Optimistic UI for phase advance only — never for a prediction verdict or a grade.
 */
export interface ApiClient {
  createLab(body: CreateLabRequest): Promise<Result<CreateLabResponse, Error>>;
  getLab(id: SessionId): Promise<Result<GetLabResponse, Error>>;
  patchLab(id: SessionId, body: PatchLabRequest): Promise<Result<PatchLabResponse, Error>>;
  postEvents(id: SessionId, body: PostEventsRequest): void;
  predict(id: SessionId, body: PredictRequest): Promise<Result<PredictResponse, Error>>;
  coach(id: SessionId, body: CoachRequest): Promise<Result<CoachResponse, Error>>;
  remix(id: SessionId, body: RemixRequest): Promise<Result<RemixResponse, Error>>;
  buildAssessment(id: SessionId): Promise<Result<unknown, Error>>;
  gradeAssessment(id: SessionId, body: GradeRequest): Promise<Result<GradeResponse, Error>>;
  recap(id: SessionId): Promise<Result<RecapResponse, Error>>;
}

export function createApiClient(_baseUrl: string): ApiClient {
  // TODO(FRONTEND)
  throw new NotImplemented("lab-client/createApiClient");
}
