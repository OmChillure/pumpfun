"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import * as React from "react";
import { ReactNode, Suspense, useEffect, useRef } from "react";
import toast, { Toaster } from "react-hot-toast";
import {
  ClusterChecker,
  ClusterUiSelect,
  ExplorerLink,
} from "../cluster/cluster-ui";
import {
  IsWalletConnected as checkWalletConnection,
  WalletButton,
} from "../solana/solana-provider";
import { IconBrandX } from "@tabler/icons-react";
import Image from "next/image";

export function UiLayout({
  children,
  links,
}: {
  children: ReactNode;
  links: { label: string; path: string }[];
}) {
  const pathname = usePathname();
  const walletConnected = checkWalletConnection();

  return (
    <div className="min-h-screen flex flex-col bg-[#ADB3A9]">
      <div className="navbar bg-[#ADB3A9] text-gray-800 flex-col md:flex-row space-y-2 md:space-y-0 px-4 py-2 border-b-2 border-[#8b8b8b]">
        <div className="flex-1">
          <Link className="btn btn-ghost normal-case text-xl" href="/">
            <Image src={"/pump.png"} alt="logo" height={55} width={55}></Image>
          </Link>
          <ul className="menu menu-horizontal px-1 space-x-2">
            {links.map(({ label, path }) => (
              <li key={path}>
                <Link
                  className={pathname.startsWith(path) ? "active" : ""}
                  href={path}
                >
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div className="gap-3">
          <button className="px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-gray-600 focus:ring-opacity-50">
            <Link href="/create">Launch Token</Link>
          </button>
          <div className="flex-none space-x-2">
            <WalletButton
              style={{
                backgroundColor: "#000000",
                padding: "0px 10px",
                borderRadius: "4px",
                width: "8rem",
                height: "42px",
                border: "1px solid rgba(55, 65, 81, 0.5)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: "normal",
                color: "white",
                fontSize: "15px",
              }}
            />
          </div>
        </div>
      </div>
      <div className="flex-grow mx-4 lg:mx-auto">
        <Suspense
          fallback={
            <div className="text-center my-32">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
            </div>
          }
        >
          {children}
        </Suspense>
        <Toaster position="bottom-right" />
      </div>
    </div>
  );
}

export function AppModal({
  children,
  title,
  hide,
  show,
  submit,
  submitDisabled,
  submitLabel,
}: {
  children: ReactNode;
  title: string;
  hide: () => void;
  show: boolean;
  submit?: () => void;
  submitDisabled?: boolean;
  submitLabel?: string;
}) {
  const dialogRef = useRef<HTMLDialogElement | null>(null);

  useEffect(() => {
    if (!dialogRef.current) return;
    if (show) {
      dialogRef.current.showModal();
    } else {
      dialogRef.current.close();
    }
  }, [show, dialogRef]);

  return (
    <dialog className="modal" ref={dialogRef}>
      <div className="modal-box space-y-5">
        <h3 className="font-bold text-lg">{title}</h3>
        {children}
        <div className="modal-action">
          <div className="join space-x-2">
            {submit ? (
              <button
                className="btn btn-xs lg:btn-md btn-primary"
                onClick={submit}
                disabled={submitDisabled}
              >
                {submitLabel || "Save"}
              </button>
            ) : null}
            <button onClick={hide} className="btn">
              Close
            </button>
          </div>
        </div>
      </div>
    </dialog>
  );
}

export function AppHero({
  children,
  title,
  subtitle,
}: {
  children?: ReactNode;
  title: ReactNode;
  subtitle: ReactNode;
}) {
  return (
    <div className="hero py-[64px]">
      <div className="hero-content text-center">
        <div className="max-w-2xl">
          {typeof title === "string" ? (
            <h1 className="text-5xl font-bold">{title}</h1>
          ) : (
            title
          )}
          {typeof subtitle === "string" ? (
            <p className="py-6">{subtitle}</p>
          ) : (
            subtitle
          )}
          {children}
        </div>
      </div>
    </div>
  );
}

export function ellipsify(str = "", len = 4) {
  if (str.length > 30) {
    return (
      str.substring(0, len) + ".." + str.substring(str.length - len, str.length)
    );
  }
  return str;
}

export function useTransactionToast() {
  return (signature: string) => {
    toast.success(
      <div className={"text-center"}>
        <div className="text-lg">Transaction sent</div>
        <ExplorerLink
          path={`tx/${signature}`}
          label={"View Transaction"}
          className="btn btn-xs btn-primary"
        />
      </div>
    );
  };
}

