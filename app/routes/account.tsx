import { useLoaderData } from "@remix-run/react";
import { requireUserId } from "~/session.server";
import type { LoaderFunctionArgs } from "@remix-run/node";
import { getUserById } from "~/models/user.server";
import Layout from "~/components / Layout/Layout";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const userId = await requireUserId(request);
  const user = await getUserById(userId);
  return {user};
}

export default function Account() {

  const data = useLoaderData<typeof loader>();

  console.log(data)

  return (
    <Layout title="Account Settings">
      <p>Account forms</p>
      <p>User ID: {data.user.id}</p>
    </Layout>
  )
}