import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { requireUserId } from "~/session.server";
import { isUserAdmin, getAllUsersWithStats } from "~/models/user.server";
import Layout from "~/components / Layout/Layout";

export const handle = {
  breadcrumb: () => <span>Admin Dashboard</span>,
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const userId = await requireUserId(request);

  const isAdmin = await isUserAdmin(userId);
  if (!isAdmin) {
    throw new Response("Forbidden", { status: 403 });
  }

  const users = await getAllUsersWithStats();

  const stats = {
    totalUsers: users.length,
    totalBooks: users.reduce((sum, u) => sum + u.bookCount, 0),
    totalFriendships: users.reduce((sum, u) => sum + u.friendCount, 0) / 2,
    adminCount: users.filter((u) => u.isAdmin).length,
  };

  return json({ users, stats });
};

export default function Dashboard() {
  const { users, stats } = useLoaderData<typeof loader>();

  return (
    <>
      <Layout title="Admin Dashboard">
        <section className="border rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Overview</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-stone-100 rounded-lg p-4 text-center">
              <dd className="text-3xl font-semibold text-stone-900 dark:text-stone-100">{stats.totalUsers}</dd>
              <dt className="text-sm text-stone-600">Total Users</dt>
            </div>
            <div className="bg-stone-100 rounded-lg p-4 text-center">
              <dd className="text-3xl font-semibold text-stone-900 dark:text-stone-100">{stats.totalBooks}</dd>
              <dt className="text-sm text-stone-600">Total Books</dt>
            </div>
            <div className="bg-stone-50 rounded-lg p-4 text-center">
              <dd className="text-3xl font-semibold text-stone-600">{Math.floor(stats.totalFriendships)}</dd>
              <dt className="text-sm text-stone-600">Friendships</dt>
            </div>
            <div className="bg-stone-50 rounded-lg p-4 text-center">
              <dd className="text-3xl font-semibold text-stone-600">{stats.adminCount}</dd>
              <dt className="text-sm text-stone-600">Admins</dt>
            </div>
          </div>
        </section>

        <section className="border rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">All Users ({users.length})</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="pb-3 font-medium">Name</th>
                  <th className="pb-3 font-medium">Email</th>
                  <th className="pb-3 font-medium text-center">Books</th>
                  <th className="pb-3 font-medium text-center">Friends</th>
                  <th className="pb-3 font-medium">Joined</th>
                  <th className="pb-3 font-medium text-center">Admin</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id} className="border-b last:border-0">
                    <td className="py-3">
                      <span className="font-medium">{user.firstname} {user.surname}</span>
                    </td>
                    <td className="py-3 text-stone-600">{user.email}</td>
                    <td className="py-3 text-center">{user.bookCount}</td>
                    <td className="py-3 text-center">{user.friendCount}</td>
                    <td className="py-3 text-stone-600">
                      {new Date(user.createdAt).toLocaleDateString()}
                    </td>
                    <td className="py-3 text-center">
                      {user.isAdmin ? (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-stone-100 text-stone-900 dark:text-stone-100">
                          Admin
                        </span>
                      ) : (
                        <span className="text-stone-400">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </Layout>
    </>
  );
}
