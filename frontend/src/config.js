import { Amplify } from 'aws-amplify';

Amplify.configure({
    Auth: {
        region: 'us-east-1',
        userPoolId: 'us-east-1_lOLYXthG0',
        userPoolWebClientId: '2u7ggm9t0934c27h39bhci9h03'
    }
});
