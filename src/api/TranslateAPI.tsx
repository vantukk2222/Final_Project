export const translateTextAzure = async (
  text: string,
  toLang: string = 'en',
  subscriptionKey: any,
  region: string,
) => {
  const endpoint = 'https://api.cognitive.microsofttranslator.com/translate';
  //   const subscriptionKey = 'YOUR_TRANSLATOR_KEY'; // 🔁 thay bằng key thật
  //   const region = 'YOUR_REGION'; // ví dụ: 'eastasia'
  const params = `?api-version=3.0&to=${toLang}`;

  const url = `${endpoint}${params}`;
  const headers = {
    'Ocp-Apim-Subscription-Key': subscriptionKey,
    'Ocp-Apim-Subscription-Region': region,
    'Content-type': 'application/json',
  };

  const body = JSON.stringify([{Text: text}]);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body,
    });

    const data = await response.json();
    // console.log('Translation response:', data);
    return data?.[0]?.translations?.[0]?.text || '';
  } catch (error) {
    console.error('Translation API error:', error);
    return '';
  }
};
