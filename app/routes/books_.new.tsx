import type { ActionFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { Form, useActionData } from "@remix-run/react";
import { useEffect, useRef } from "react";
import { createBook } from "~/models/book.server";
import { requireUserId } from "~/session.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const userId = await requireUserId(request);

  const formData = await request.formData();
  const title = formData.get("title");
  const author = formData.get("author");
  const cover = formData.get("cover");
  const body = formData.get("body");
  const datePublished = formData.get("datePublished");

  if (typeof title !== "string" || title.length === 0) {
    return json(
      { errors: { title: "Title is required", author: null, body: null, cover: null, datePublished: null } },
      { status: 400 }
    );
  }

  if (typeof author !== "string" || author.length === 0) {
    return json(
      { errors: { title: null, author: "Author is required", body: null, cover: null, datePublished: null } },
      { status: 400 }
    );
  }

  if (typeof body !== "string" || body.length === 0) {
    return json(
      { errors: { title: null, author: null, body: "Description is required", cover: null, datePublished: null } },
      { status: 400 }
    );
  }

  if (typeof cover !== "string" || cover.length === 0) {
    return json(
      { errors: { title: null, author: null, body: null, cover: "Cover URL is required", datePublished: null } },
      { status: 400 }
    );
  }

  const book = await createBook({
    body,
    title,
    cover,
    author,
    datePublished: typeof datePublished === "string" && datePublished.length > 0 ? datePublished : null,
    userId,
  });

  return redirect(`/books/${book.id}`);
};

export default function NewBookPage() {
  const actionData = useActionData<typeof action>();
  const titleRef = useRef<HTMLInputElement>(null);
  const authorRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const coverRef = useRef<HTMLInputElement>(null);
  const datePublishedRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (actionData?.errors?.title) {
      titleRef.current?.focus();
    } else if (actionData?.errors?.author) {
      authorRef.current?.focus();
    } else if (actionData?.errors?.body) {
      bodyRef.current?.focus();
    } else if (actionData?.errors?.cover) {
      coverRef.current?.focus();
    }
  }, [actionData]);

  return (
    <Form
      method="post"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 8,
        width: "100%",
      }}
    >
      <div>
        <label className="flex w-full flex-col gap-1">
          <span>Title: </span>
          <input
            ref={titleRef}
            name="title"
            className="flex-1 rounded-md border-2 border-blue-500 px-3 text-lg leading-loose"
            aria-invalid={actionData?.errors?.title ? true : undefined}
            aria-errormessage={
              actionData?.errors?.title ? "title-error" : undefined
            }
          />
        </label>
        {actionData?.errors?.title ? (
          <div className="pt-1 text-red-700" id="title-error">
            {actionData.errors.title}
          </div>
        ) : null}
      </div>

      <div>
        <label className="flex w-full flex-col gap-1">
          <span>Author: </span>
          <input
            ref={authorRef}
            name="author"
            className="flex-1 rounded-md border-2 border-blue-500 px-3 text-lg leading-loose"
            aria-invalid={actionData?.errors?.author ? true : undefined}
            aria-errormessage={
              actionData?.errors?.author ? "author-error" : undefined
            }
          />
        </label>
        {actionData?.errors?.author ? (
          <div className="pt-1 text-red-700" id="author-error">
            {actionData.errors.author}
          </div>
        ) : null}
      </div>

      <div>
        <label className="flex w-full flex-col gap-1">
          <span>Cover URL: </span>
          <input
            ref={coverRef}
            name="cover"
            className="flex-1 rounded-md border-2 border-blue-500 px-3 text-lg leading-loose"
            aria-invalid={actionData?.errors?.cover ? true : undefined}
            aria-errormessage={
              actionData?.errors?.cover ? "cover-error" : undefined
            }
          />
        </label>
        {actionData?.errors?.cover ? (
          <div className="pt-1 text-red-700" id="cover-error">
            {actionData.errors.cover}
          </div>
        ) : null}
      </div>

      <div>
        <label className="flex w-full flex-col gap-1">
          <span>Date Published (optional): </span>
          <input
            ref={datePublishedRef}
            name="datePublished"
            placeholder="e.g., 1984, March 2020"
            className="flex-1 rounded-md border-2 border-blue-500 px-3 text-lg leading-loose"
          />
        </label>
      </div>

      <div>
        <label className="flex w-full flex-col gap-1">
          <span>Description: </span>
          <textarea
            ref={bodyRef}
            name="body"
            rows={8}
            className="w-full flex-1 rounded-md border-2 border-blue-500 px-3 py-2 text-lg leading-6"
            aria-invalid={actionData?.errors?.body ? true : undefined}
            aria-errormessage={
              actionData?.errors?.body ? "body-error" : undefined
            }
          />
        </label>
        {actionData?.errors?.body ? (
          <div className="pt-1 text-red-700" id="body-error">
            {actionData.errors.body}
          </div>
        ) : null}
      </div>

      <div className="text-right">
        <button
          type="submit"
          className="rounded bg-blue-500 px-4 py-2 text-white hover:bg-blue-600 focus:bg-blue-400"
        >
          Save
        </button>
      </div>
    </Form>
  );
}
