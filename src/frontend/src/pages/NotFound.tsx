import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import MainLayout from '../components/Layout/MainLayout';
import { Button } from '../components/Common/Button';

export default function NotFound() {
  return (
    <MainLayout>
      <Helmet>
        <title>Page Not Found | DevAssistant</title>
      </Helmet>
      <div className="flex flex-col items-center justify-center h-full text-center p-8">
        <h1 className="text-4xl font-bold mb-4">404 - Page Not Found</h1>
        <p className="text-lg mb-8">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <Button variant="primary" as={Link} to="/">
          Return to Home
        </Button>
      </div>
    </MainLayout>
  );
}
