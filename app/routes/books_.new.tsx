import type {
  ActionFunctionArgs,
  MetaFunction,
} from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { Form, useActionData } from "@remix-run/react";
import { useEffect, useRef } from "react";

import { createBook } from "~/models/book.server";
import { seo } from "~/seo";
import { requireUserId } from "~/session.server";

export const meta: MetaFunction = () =>
  seo({ title: "Add a book", noindex: true });

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
      {
        errors: {
          title: "Title is required",
          author: null,
          body: null,
          cover: null,
          datePublished: null,
        },
      },
      { status: 400 },
    );
  }

  if (typeof author !== "string" || author.length === 0) {
    return json(
      {
        errors: {
          title: null,
          author: "Author is required",
          body: null,
          cover: null,
          datePublished: null,
        },
      },
      { status: 400 },
    );
  }

  if (typeof body !== "string" || body.length === 0) {
    return json(
      {
        errors: {
          title: null,
          author: null,
          body: "Description is required",
          cover: null,
          datePublished: null,
        },
      },
      { status: 400 },
    );
  }

  if (typeof cover !== "string" || cover.length === 0) {
    return json(
      {
        errors: {
          title: null,
          author: null,
          body: null,
          cover: "Cover URL is required",
          datePublished: null,
        },
      },
      { status: 400 },
    );
  }

  const book = await createBook({
    body,
    title,
    cover,
    author,
    datePublished:
      typeof datePublished === "string" && datePublished.length > 0
        ? datePublished
        : null,
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
            className="flex-1 rounded-md border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 px-3 py-2 text-stone-900 dark:text-stone-100 placeholder:text-stone-400 dark:placeholder:text-stone-500 focus:outline-none focus:border-stone-400 dark:focus:border-stone-500 focus:ring-2 focus:ring-stone-900/10 dark:focus:ring-white/10 transition-colors"
            aria-invalid={actionData?.errors?.title ? true : undefined}
            aria-errormessage={
              actionData?.errors?.title ? "title-error" : undefined
            }
          />
        </label>
        {actionData?.errors?.title ? (
          <div
            className="pt-1 text-stone-900 dark:text-stone-100"
            id="title-error"
          >
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
            className="flex-1 rounded-md border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 px-3 py-2 text-stone-900 dark:text-stone-100 placeholder:text-stone-400 dark:placeholder:text-stone-500 focus:outline-none focus:border-stone-400 dark:focus:border-stone-500 focus:ring-2 focus:ring-stone-900/10 dark:focus:ring-white/10 transition-colors"
            aria-invalid={actionData?.errors?.author ? true : undefined}
            aria-errormessage={
              actionData?.errors?.author ? "author-error" : undefined
            }
          />
        </label>
        {actionData?.errors?.author ? (
          <div
            className="pt-1 text-stone-900 dark:text-stone-100"
            id="author-error"
          >
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
            className="flex-1 rounded-md border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 px-3 py-2 text-stone-900 dark:text-stone-100 placeholder:text-stone-400 dark:placeholder:text-stone-500 focus:outline-none focus:border-stone-400 dark:focus:border-stone-500 focus:ring-2 focus:ring-stone-900/10 dark:focus:ring-white/10 transition-colors"
            aria-invalid={actionData?.errors?.cover ? true : undefined}
            aria-errormessage={
              actionData?.errors?.cover ? "cover-error" : undefined
            }
          />
        </label>
        {actionData?.errors?.cover ? (
          <div
            className="pt-1 text-stone-900 dark:text-stone-100"
            id="cover-error"
          >
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
            className="flex-1 rounded-md border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 px-3 py-2 text-stone-900 dark:text-stone-100 placeholder:text-stone-400 dark:placeholder:text-stone-500 focus:outline-none focus:border-stone-400 dark:focus:border-stone-500 focus:ring-2 focus:ring-stone-900/10 dark:focus:ring-white/10 transition-colors"
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
            className="w-full flex-1 rounded-md border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 px-3 py-2 text-stone-900 dark:text-stone-100 placeholder:text-stone-400 dark:placeholder:text-stone-500 focus:outline-none focus:border-stone-400 dark:focus:border-stone-500 focus:ring-2 focus:ring-stone-900/10 dark:focus:ring-white/10 transition-colors leading-relaxed"
            aria-invalid={actionData?.errors?.body ? true : undefined}
            aria-errormessage={
              actionData?.errors?.body ? "body-error" : undefined
            }
          />
        </label>
        {actionData?.errors?.body ? (
          <div
            className="pt-1 text-stone-900 dark:text-stone-100"
            id="body-error"
          >
            {actionData.errors.body}
          </div>
        ) : null}
      </div>

      <div className="text-right">
        <button
          type="submit"
          className="rounded-md bg-stone-900 dark:bg-stone-100 px-4 py-2 text-sm font-medium text-white dark:text-stone-900 hover:bg-stone-700 dark:hover:bg-stone-300 transition-colors"
        >
          Save
        </button>
      </div>
    </Form>
  );
}
