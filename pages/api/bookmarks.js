import request, { gql } from "graphql-request";
import { getServerSession } from "next-auth";
import { getToken } from "next-auth/jwt";

import { authOptions } from "@auth/[...nextauth]";

const secret = process.env.NEXTAUTH_SECRET;
export default async (req, res) => {
  const session = await getServerSession(req, res, authOptions);

  const author = req.query.author || 105;
  const searchTerm = req.query.searchTerm;

  if (session) {
    const token = await getToken({
      req,
      secret,
      raw: true,
    });

    if (token) {
      // Signed in
      let whereClause = "";
      if (searchTerm) {
        const searchCondition = `%${searchTerm}%`;
        whereClause = `
        where: {
          _or: [
            { notes: { _ilike: "${searchCondition}" } },
            { labels: { _cast: { String: { _ilike: "${searchCondition}" } } } },
            { verse: { verse: { _ilike: "${searchCondition}" } } },
            { verse: { transcription: { _ilike: "${searchCondition}" } } },
            { verse: { translations: { text: { _ilike: "${searchCondition}" } } } }
          ]
        }`;
      }

      const query = gql`
        query usersBookmarksQuery {
          users_bookmarks(order_by: { updated_at: desc } ${whereClause}) {
            id
            bookmarkKey
            bookmarkItem
            type
            updated_at
            notes
            labels
            verse {
              page
              surah {
                id
                name
                name_en
              }
              verse_number
              verse
              transcription
              translations(where: { author_id: { _eq: ${author} } }) {
                id
                author_id
                text
              }
            }
          }
        }
      `;

      const data = await request(process.env.HASURA_API_ENDPOINT, query, null, {
        authorization: `Bearer ${token}`,
      });
      res.send(data);
    } else {
      // Not Signed in
      res.status(401);
    }
    res.end();
  } else {
    res.status(401);
    res.send({
      error:
        "You must be signed in to view the protected content on this page.",
    });
  }
};
