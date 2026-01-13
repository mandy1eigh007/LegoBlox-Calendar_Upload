export function generatePublicId(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 20; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export function getStudentUrl(publicId: string): string {
  const baseUrl = window.location.origin;
  return `${baseUrl}/student/${publicId}`;
}

export function getPublishedUrl(slug: string): string {
  const baseUrl = window.location.origin;
  return `${baseUrl}/p/${slug}`;
}

export async function publishPlanToServer(planId: string, plan: any, slug: string): Promise<{ success: boolean; slug?: string; error?: string }> {
  try {
    const response = await fetch(`/api/plans/${planId}/publish`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ slug, plan }),
    });

    if (!response.ok) {
      const error = await response.json();
      return { success: false, error: error.error || 'Failed to publish' };
    }

    const data = await response.json();
    return { success: true, slug: data.slug };
  } catch (error) {
    console.error('Error publishing plan:', error);
    return { success: false, error: 'Network error' };
  }
}

export async function unpublishPlanFromServer(slug: string): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch(`/api/published/${slug}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      const error = await response.json();
      return { success: false, error: error.error || 'Failed to unpublish' };
    }

    return { success: true };
  } catch (error) {
    console.error('Error unpublishing plan:', error);
    return { success: false, error: 'Network error' };
  }
}
