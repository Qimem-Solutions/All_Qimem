import { LoginForm } from "./login-form";

type Props = {
  searchParams: Promise<{ oauth?: string; detail?: string }>;
};

export default async function LoginPage(props: Props) {
  const searchParams = await props.searchParams;
  return (
    <LoginForm oauth={searchParams.oauth} oauthDetail={searchParams.detail} />
  );
}
