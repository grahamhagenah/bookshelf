
import { Form, Link } from "@remix-run/react";
import { NavLink, Outlet, useLoaderData } from "@remix-run/react";
import logo from "~/images/logo-alt.svg";
import type { LoaderFunctionArgs } from "@remix-run/node";
import { requireUserId } from "~/session.server";
import * as React from 'react';
import Button from '@mui/material/Button';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import { getUserById } from "~/models/user.server";
import Search from "./search"


export const loader = async ({ request }: LoaderFunctionArgs) => {
  const userId = await requireUserId(request);
  const user = await getUserById({ userId });
  return user;
}


export default function Header() {
  
  return (
    <header className="w-full flex items-center justify-between">
      <h1 className="text-3xl font-bold">
        <Link to="/books">
          <img id="logo" src={logo} alt="Lend"/>
        </Link>
      </h1>
      <div className="flex">
        <Search />
      <PositionedMenu/>
    </div>
    </header>
)}

function PositionedMenu() {
  const data = useLoaderData<typeof loader>();
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);
  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };
  const handleClose = () => {
    setAnchorEl(null);
  };

  return (
    <>
      <Button
        id="demo-positioned-button"
        aria-controls={open ? 'demo-positioned-menu' : undefined}
        aria-haspopup="true"
        aria-expanded={open ? 'true' : undefined}
        onClick={handleClick}
      >
        {data.user ? data.user.firstname: "hello"}
      </Button>
      <Menu
        id="demo-positioned-menu"
        aria-labelledby="demo-positioned-button"
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        anchorOrigin={{
          vertical: 'top',
          horizontal: 'left',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'left',
        }}
      >
        <MenuItem onClick={handleClose}>Profile</MenuItem>
        <MenuItem onClick={handleClose}>My account</MenuItem>
        <MenuItem onClick={handleClose}>
          <Form action="/logout" method="post">
            <button type="submit">
              Logout
            </button>
          </Form>
        </MenuItem>
      </Menu>
    </>
  );
}