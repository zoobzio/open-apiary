import { describe, expect, it } from "vitest";

import { identify } from "../src/identify";

describe("identify", () => {
  it("joins the lower-case method and the PascalCase segments", () => {
    expect(identify("GET", "/users")).toBe("getUsers");
  });

  it("turns a parameter segment into By and the name", () => {
    expect(identify("GET", "/users/{id}")).toBe("getUsersById");
  });

  it("keeps the segments in route order", () => {
    expect(identify("POST", "/users/{id}/posts")).toBe("postUsersByIdPosts");
  });

  it("names the root route Root", () => {
    expect(identify("GET", "/")).toBe("getRoot");
  });

  it("turns a kebab-case segment into PascalCase", () => {
    expect(identify("DELETE", "/user-posts/{id}")).toBe("deleteUserPostsById");
  });

  it("turns a parameter name with dashes into PascalCase", () => {
    expect(identify("PATCH", "/teams/{team-id}/members/{member-id}")).toBe(
      "patchTeamsByTeamIdMembersByMemberId",
    );
  });

  it("ignores empty segments", () => {
    expect(identify("PUT", "/users//{id}/")).toBe("putUsersById");
  });
});
